// URL se book ka naam auto-fill karna
const urlParams = new URLSearchParams(window.location.search);
const bookTitleParam = urlParams.get('title');
if (bookTitleParam) {
    document.getElementById('post-title').value = bookTitleParam;
}

// LocalStorage setup
let posts = JSON.parse(localStorage.getItem('biblioDrift_posts')) || [];
const postForm = document.getElementById('post-form');
const postsContainer = document.getElementById('posts-container');

function savePosts() {
    localStorage.setItem('biblioDrift_posts', JSON.stringify(posts));
}

function renderPosts() {
    postsContainer.innerHTML = ''; 
    posts.forEach((post, index) => {
        const card = document.createElement('div');
        card.className = 'post-card';
        card.innerHTML = `
            <div class="post-header">
                <div class="avatar-icon"><i class="fa-solid fa-user"></i></div>
                <strong>${post.username}</strong>
            </div>
            <h3 class="post-title">${post.title}</h3>
            <p class="post-text">${post.content}</p>
            
            <button onclick="likePost(${index})" class="like-btn">
                <i class="fa-solid fa-heart"></i> ${post.likes} Likes
            </button>
            
            <div class="comments-section">
                <h4><i class="fa-solid fa-comments"></i> Comments</h4>
                ${post.comments.map(c => `<div class="comment"><i class="fa-solid fa-reply"></i> ${c}</div>`).join('')}
                <div class="add-comment">
                    <input type="text" id="comment-input-${index}" class="styled-input" placeholder="Add a comment..." style="margin-bottom: 0;">
                    <button onclick="addComment(${index})" class="btn-secondary">Reply</button>
                </div>
            </div>
        `;
        postsContainer.appendChild(card);
    });
}

postForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newPost = {
        username: "WanderingReader", 
        title: document.getElementById('post-title').value,
        content: document.getElementById('post-content').value,
        likes: 0,
        comments: []
    };
    posts.unshift(newPost); 
    savePosts();
    renderPosts();
    postForm.reset(); 
});

window.likePost = (index) => {
    posts[index].likes++;
    savePosts();
    renderPosts();
}

window.addComment = (index) => {
    const input = document.getElementById(`comment-input-${index}`);
    if(input.value.trim() !== "") {
        posts[index].comments.push(input.value.trim());
        savePosts();
        renderPosts();
    }
}

renderPosts();