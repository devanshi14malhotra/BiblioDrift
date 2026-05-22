const aiSearchBtn = document.getElementById("aiSearchBtn");
const aiSearchInput = document.getElementById("aiSearchInput");
const aiResults = document.getElementById("aiSearchResults");

const API_BASE = "http://127.0.0.1:5000";

aiSearchBtn.addEventListener("click", async () => {

    const query = aiSearchInput.value.trim();

    if (!query) {
        alert("Enter search query");
        return;
    }

    aiResults.innerHTML = `
        <div class="ai-loading">
            🤖 AI is searching books...
        </div>
    `;

    try {

        const response = await fetch(
            `${API_BASE}/api/v1/mood-search`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    query: query
                })
            }
        );

        const result = await response.json();

        console.log(result);

        const books = result.data.recommendations || [];

        if (books.length === 0) {
            aiResults.innerHTML = `
                <p>No books found.</p>
            `;
            return;
        }

        aiResults.innerHTML = "";

        books.forEach(book => {

            const card = document.createElement("div");

            card.className = "ai-book-card";

            card.innerHTML = `
                <img src="${book.thumbnail || 'https://via.placeholder.com/200x300'}">

                <h3>${book.title}</h3>

                <p><strong>Author:</strong> ${book.author || "Unknown"}</p>

                <p>${book.reason || ""}</p>
            `;

            aiResults.appendChild(card);
        });

    } catch (error) {

        console.error(error);

        aiResults.innerHTML = `
            <p>AI Search failed.</p>
        `;
    }
});



/* ENTER KEY SUPPORT */

aiSearchInput.addEventListener("keypress", (e) => {

    if (e.key === "Enter") {
        aiSearchBtn.click();
    }

});