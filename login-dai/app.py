from __future__ import annotations

import os
import sqlite3
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen, Request

from dotenv import load_dotenv
from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    session,
    flash,
)
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "login.db"

app = Flask(__name__, static_folder="static", template_folder="templates")
app.secret_key = os.environ.get("LOGIN_SECRET_KEY", "dev-secret-key")
app.permanent_session_lifetime = timedelta(days=7)


def init_db() -> None:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS phone_otps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL,
            code_hash TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            created_at INTEGER NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


@app.before_request
def _ensure_db() -> None:
    init_db()


@app.get("/")
@app.get("/login")
def login_page():
    return render_template("index.html")


def _otp_secret() -> str:
    return os.environ.get("OTP_SECRET_KEY", app.secret_key)


def _hash_otp(code: str) -> str:
    return hashlib.sha256(f"{code}:{_otp_secret()}".encode("utf-8")).hexdigest()


def _store_phone_otp(phone: str, code: str, ttl_seconds: int) -> None:
    now = int(datetime.now(tz=timezone.utc).timestamp())
    expires_at = now + ttl_seconds
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("DELETE FROM phone_otps WHERE phone = ?", (phone,))
    cur.execute(
        """
        INSERT INTO phone_otps (phone, code_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (phone, _hash_otp(code), expires_at, now),
    )
    conn.commit()
    conn.close()


def _verify_phone_otp(phone: str, code: str) -> bool:
    now = int(datetime.now(tz=timezone.utc).timestamp())
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, code_hash, expires_at
        FROM phone_otps
        WHERE phone = ?
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (phone,),
    )
    row = cur.fetchone()
    if row is None:
        conn.close()
        return False

    otp_id, code_hash, expires_at = row
    if expires_at < now:
        cur.execute("DELETE FROM phone_otps WHERE id = ?", (otp_id,))
        conn.commit()
        conn.close()
        return False

    if _hash_otp(code) != code_hash:
        conn.close()
        return False

    cur.execute("DELETE FROM phone_otps WHERE id = ?", (otp_id,))
    conn.commit()
    conn.close()
    return True


def _send_smslocal(phone: str, message: str) -> tuple[bool, str | None]:
    api_key = os.environ.get("SMSLOCAL_API_KEY")
    sender = os.environ.get("SMSLOCAL_SENDER")
    route = os.environ.get("SMSLOCAL_ROUTE", "2")
    template_id = os.environ.get("SMSLOCAL_TEMPLATE_ID")
    api_url = os.environ.get("SMSLOCAL_API_URL", "https://app.smslocal.in/api/smsapi")

    if not api_key or not sender:
        return False, "SMSLocal not configured. Set SMSLOCAL_API_KEY and SMSLOCAL_SENDER."

    payload = {
        "key": api_key,
        "route": route,
        "sender": sender,
        "number": phone,
        "sms": message,
    }
    if template_id:
        payload["templateid"] = template_id

    url = f"{api_url}?{urlencode(payload)}"
    try:
        req = Request(url, method="GET")
        with urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8", errors="ignore")
        if "error" in body.lower() or "invalid" in body.lower():
            return False, body
        return True, None
    except Exception as exc:
        return False, f"SMS send failed: {exc}"




def _imagine_url() -> str:
    return os.environ.get("IMAGINE_URL", "https://imagine-2lsn.onrender.com")


def _normalize_in_phone(raw: str) -> str | None:
    phone = raw.strip().replace(" ", "")
    if not phone:
        return None
    if phone.startswith("+91"):
        digits = phone[3:]
        if digits.isdigit() and len(digits) == 10:
            return f"+91{digits}"
        return None
    if phone.isdigit() and len(phone) == 10:
        return f"+91{phone}"
    return None


@app.post("/auth/email")
def auth_email():
    email = request.form.get("email", "").strip().lower()
    password = request.form.get("password", "").strip()

    if not email or not password:
        flash("Email and password are required.")
        return redirect(url_for("login_page"))

    if len(password) < 6:
        flash("Password must be at least 6 characters.")
        return redirect(url_for("login_page"))

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT id, password FROM users WHERE email = ?", (email,))
    row = cur.fetchone()

    if row is None:
        hashed = generate_password_hash(password)
        cur.execute("INSERT INTO users (email, password) VALUES (?, ?)", (email, hashed))
        conn.commit()
        user_id = cur.lastrowid
    else:
        user_id, stored_password = row
        if stored_password:
            if not check_password_hash(stored_password, password):
                conn.close()
                flash("Incorrect password.")
                return redirect(url_for("login_page"))
        else:
            hashed = generate_password_hash(password)
            cur.execute("UPDATE users SET password = ? WHERE id = ?", (hashed, user_id))
            conn.commit()

    conn.close()

    session.permanent = True
    session["user_id"] = user_id
    return redirect(_imagine_url())


@app.post("/auth/phone/request")
def auth_phone_request():
    raw_phone = request.form.get("phone", "")
    phone = _normalize_in_phone(raw_phone)
    if not phone:
        flash("Enter a valid +91 mobile number.")
        return redirect(url_for("login_page"))

    otp = f"{secrets.randbelow(10000):04d}"
    ttl_seconds = int(os.environ.get("OTP_TTL_SECONDS", "300"))
    _store_phone_otp(phone, otp, ttl_seconds)

    message = f"Your DAI login OTP is {otp}. It expires in 5 minutes."
    ok, error = _send_smslocal(phone, message)
    if ok:
        session["pending_phone"] = phone
        flash("OTP sent to your phone.")
    else:
        flash(error or "Failed to send OTP.")
        flash(f"Demo OTP (configure SMSLocal to send real SMS): {otp}")

    return redirect(url_for("login_page"))


@app.post("/auth/phone/verify")
def auth_phone_verify():
    raw_phone = request.form.get("phone", "")
    phone = _normalize_in_phone(raw_phone) or session.get("pending_phone")
    otp = request.form.get("otp", "").strip()

    if not phone or not otp:
        flash("Phone and OTP are required.")
        return redirect(url_for("login_page"))

    if not _verify_phone_otp(phone, otp):
        flash("Invalid or expired OTP.")
        return redirect(url_for("login_page"))

    session.permanent = True
    session["user_id"] = 0
    session.pop("pending_phone", None)
    return redirect(_imagine_url())


# OAuth placeholders
@app.get("/auth/google")
def auth_google():
    flash("Google OAuth not configured. Set GOOGLE_CLIENT_ID/SECRET to enable.")
    return redirect(url_for("login_page"))


@app.get("/auth/apple")
def auth_apple():
    flash("Apple Sign-In not configured. Set APPLE_CLIENT_ID/SECRET to enable.")
    return redirect(url_for("login_page"))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
