document.querySelectorAll(".faq-question").forEach(btn => {
  btn.addEventListener("click", () => {
    const answer = btn.nextElementSibling;
    answer.style.display = answer.style.display === "block" ? "none" : "block";
  });
});

const words = ["notes.", "website.", "documents.", "imagination."];
let i = 0;
const text = document.getElementById("changingText");

setInterval(() => {
  text.classList.add("fade-out");

  setTimeout(() => {
    i = (i + 1) % words.length;
    text.textContent = words[i];
    text.classList.remove("fade-out");
    text.classList.add("fade-in");
  }, 400);

}, 2000);
