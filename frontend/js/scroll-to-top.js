document.addEventListener("DOMContentLoaded", () => {
  const scrollBtn = document.createElement("button");

  scrollBtn.className = "scroll-top-btn";
  scrollBtn.setAttribute("aria-label", "Scroll to top");
  scrollBtn.innerHTML = "↑";

  document.body.appendChild(scrollBtn);

  const footer = document.querySelector("footer");

  const toggleButtonVisibility = () => {
    if (window.scrollY > 300) {
      scrollBtn.classList.add("show");
    } else {
      scrollBtn.classList.remove("show");
    }
  };

  window.addEventListener("scroll", toggleButtonVisibility);

  scrollBtn.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });

  if (footer) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          scrollBtn.classList.remove("show");
        } else if (window.scrollY > 300) {
          scrollBtn.classList.add("show");
        }
      });
    });

    observer.observe(footer);
  }
});