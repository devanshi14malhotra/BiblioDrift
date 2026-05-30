document.addEventListener('DOMContentLoaded', () => {
    const chatbotToggleBtn = document.getElementById('chatbot-toggle-btn');
    const chatbotWindow = document.getElementById('chatbot-window');
    const chatbotCloseBtn = document.getElementById('chatbot-close-btn');
    const chatbotSendBtn = document.getElementById('chatbot-send-btn');
    const chatbotInput = document.getElementById('chatbot-input');
    const chatbotMessages = document.getElementById('chatbot-messages');

    if (!chatbotToggleBtn || !chatbotWindow) return;

    chatbotToggleBtn.addEventListener('click', () => {
        chatbotWindow.classList.toggle('hidden');
        if (!chatbotWindow.classList.contains('hidden')) {
            chatbotInput.focus();
        }
    });

    chatbotCloseBtn.addEventListener('click', () => {
        chatbotWindow.classList.add('hidden');
    });

    const addMessage = (text, isUser = false) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isUser ? 'user-message' : 'bot-message'}`;
        const messageP = document.createElement('p');
        messageP.textContent = text;
        messageDiv.appendChild(messageP);
        chatbotMessages.appendChild(messageDiv);
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    };

    const handleSend = () => {
        const text = chatbotInput.value.trim();
        if (!text) return;

        addMessage(text, true);
        chatbotInput.value = '';

        // Simulate AI bot typing
        setTimeout(() => {
            const responses = [
                "I sense a longing for adventure in your words. Have you tried exploring the Constellation?",
                "Ah, a stormy mood. I'd recommend a cozy mystery to go with a hot cup of tea.",
                "Let me search the shelves... I might have just the book for you.",
                "That's an interesting feeling. Let me drift through the library and see what surfaces."
            ];
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            addMessage(randomResponse, false);
        }, 1000);
    };

    chatbotSendBtn.addEventListener('click', handleSend);

    chatbotInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    });
});
