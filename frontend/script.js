// Configuration
const API_URL = 'http://localhost:8000';

// DOM Elements for consideration
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

// set the current agent message element to be null for streaming text
let currentAgentMessageElement = null;

/* 
 * Append a message to the chat container
 */
function appendMessage(content, className) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${className}`;
    messageDiv.textContent = content;
    chatContainer.appendChild(messageDiv);
    scrollToBottom();
    return messageDiv;
}

/* 
 * Scroll the chat container to the bottom
 */
function scrollToBottom() {
   chatContainer.scrollTop = chatContainer.scrollHeight;
}

/* 
 * Handle different event types from the agent
 */
function handleEvent(event) {

    switch (event.type) {
        case 'text':
            if (!currentAgentMessageElement) {
                currentAgentMessageElement = appendMessage('', 'agent-message');
                currentAgentMessageElement.setAttribute('data-raw-text', ''); // initialize raw text storage
            }
            
            // accumulate the markdown text
            const currentRawText = currentAgentMessageElement.getAttribute('data-raw-text') || '';
            const newText = currentRawText + (event.content || '');
            currentAgentMessageElement.setAttribute('data-raw-text', newText);
            
            // convert markdown to HTML
            if (typeof marked !== 'undefined') {
                currentAgentMessageElement.innerHTML = marked.parse(newText);
            } else {
                currentAgentMessageElement.textContent = newText; // fallback to plain text
            }
            
            scrollToBottom();
            break;
        case 'thinking':
            appendMessage(`${event.content || 'Thinking...'}`, 'agent-thinking');
            break;    
        case 'tool_use':
            appendMessage(`Using tool: ${event.tool || 'unknown'}`, 'agent-tool-message');
            break;
        case 'tool_result':
            // Optional: display tool results
            console.log('Tool result:', event);
            break;
        case 'error':
            appendMessage(`Error: ${event.content || 'An error occurred'}`, 'agent-error-message');
            break;
        default:
            console.log('Unknown event type:', event);
    }
}

/* 
 * send message to backend and handle streaming response
 * This is the main method required to be implemented at first
 */
async function sendMessage() {
    
    const userMessageContent = messageInput.value.trim();
    if (!userMessageContent) return; // Do nothing if the message typed is empty

    appendMessage(userMessageContent, 'user-message'); // append the user message to the chat container

    // clear the input field and disable the send button
    messageInput.value = '';
    sendButton.disabled = true;

    // reset the current agent message
    currentAgentMessageElement = null;

    // Now it is time to send a message to the backend
    try {
        
        // send a response to the backend
        const response = await fetch(`${API_URL}/chat`, {
           method: 'POST',
           headers: {
            'Content-Type': 'application/json',
           },
           body: JSON.stringify({ message: userMessageContent })
        });

        // If the response is not ok, throw an error
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // read the streaming response
        const reader = response.body.getReader(); // read the message
        const decoder = new TextDecoder(); // decode the message

        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                console.log('Stream complete');
                break;
            }

            // decode the chunk
            const chunk = decoder.decode(value, { streaming: true });

            // parse sever-sent events(SSE) format
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6); // remove 'data: ' prefix

                    // check for [Done] message
                    if (data === '[DONE]') {
                        console.log('Received [DONE] message');
                        continue;
                    }

                    // parse the JSON data
                    try {
                        const event = JSON.parse(data);
                        handleEvent(event); // handle the event
                    } catch (e) {
                        console.error('Error parsing JSON:', e);
                        continue;
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error in sendMessage:', error);
        appendMessage(`Error: ${error.message}`, 'error-message');
    } finally {
        sendButton.disabled = false; // re-enable the send button
        messageInput.focus(); // focus back to the input field
    }
}

// Event listener for send button
sendButton.addEventListener('click', sendMessage);

// Event listener for Enter key in the input field
messageInput.addEventListener('keypress', function(event) {
     if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // prevent the new line
        sendMessage();
     }
});

// focus the input field on page load
messageInput.focus();




 
 


