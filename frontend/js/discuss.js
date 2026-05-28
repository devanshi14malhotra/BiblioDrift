// URL se book ka title nikal kar input field mein auto-fill karna
const urlParams = new URLSearchParams(window.location.search);
const bookTitleParam = urlParams.get('title');
if (bookTitleParam) {
    document.getElementById('post-title').value = bookTitleParam;
}
let posts = JSON.parse(localStorage.getItem('biblioDrift_posts')) || [];

const postForm = document.getElementById('post-form');
const postsContainer = document.getElementById('posts-container');

function savePosts() {
    localStorage.setItem('biblioDrift_posts', JSON.stringify(posts));
}

function renderPosts() {
    postsContainer.innerHTML = ''; 
    
    posts.forEach((post, postIndex) => {
        const postCard = document.createElement('div');
        postCard.classList.add('post-card');
        
        postCard.innerHTML = `
            <div class="post-header">
                <div class="avatar-icon"><i class="fa-solid fa-user"></i></div>
                <strong>${post.username}</strong>
            </div>
            <h3 class="post-title">${post.title}</h3>
            <p class="post-text">${post.content}</p>
            
            <div class="post-actions">
                <button onclick="likePost(${postIndex})" class="like-btn">
                    <i class="fa-solid fa-heart"></i> ${post.likes} Likes
                </button>
            </div>
            
            <div class="comments-section">
                <h4>Comments</h4>
                <div class="comments-list">
                    ${post.comments.map(comment => `<p class="comment"><i class="fa-solid fa-comment"></i> ${comment}</p>`).join('')}
                </div>
                <div class="add-comment">
                    <input type="text" id="comment-input-${postIndex}" placeholder="Add a comment...">
                    <button onclick="addComment(${postIndex})">Reply</button>
                </div>
            </div>
        `;
        postsContainer.appendChild(postCard);
    });
}

postForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const title = document.getElementById('post-title').value;
    const content = document.getElementById('post-content').value;
    
    const newPost = {
        username: "GuestReader", 
        title: title,
        content: content,
        likes: 0,
        comments: []
    };
    
    posts.unshift(newPost); 
    savePosts();
    renderPosts();
    postForm.reset(); 
});

window.likePost = function(index) {
    posts[index].likes += 1;
    savePosts();
    renderPosts();
}

window.addComment = function(index) {
    const commentInput = document.getElementById(`comment-input-${index}`);
    const commentText = commentInput.value.trim();
    
    if(commentText !== "") {
        posts[index].comments.push(commentText);
        savePosts();
        renderPosts();
    }
}

renderPosts();