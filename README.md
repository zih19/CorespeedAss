This is a chatbox simulation used to mimic how we are supposed to take advantage of Zypher documentation to implement a primitive chatbot. The instructions are written as below.

## Installation & Setup
### Step 1: clone this repository using the command on VS code
        ```bash
           git clone (the name of the repository)
        ```
### Step 2: go to backend directory, create a `.env` file from the template, edit the API key, and execute the starting command
        ```bash
           cd backend
           cp .env.example .env
           ANTHROPIC_API_KEY=sk-ant-api03-YOUR_ACTUAL_KEY_HERE
           deno run -A main.ts
        ```
### Step 3: type the web link http://localhost:8000 and start any types of conversation you want.
