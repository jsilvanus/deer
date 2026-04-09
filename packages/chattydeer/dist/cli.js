#!/usr/bin/env node
import readline from 'readline';
import ChatSession from './chat-session.js';
function usage() {
    console.log('Usage: cli [--model <name>] [--token <HF_TOKEN>] [--system <prompt>]');
    console.log('Interactive commands: /history, exit, quit');
}
async function main() {
    const args = process.argv.slice(2);
    let model = 'llama-3.2-3b';
    let token = process.env.HF_TOKEN;
    let systemPrompt = '';
    let provider = undefined;
    let device = undefined;
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '--model' || a === '-m') {
            model = args[++i] ?? model;
        }
        else if (a === '--token' || a === '-t') {
            token = args[++i] ?? token;
        }
        else if (a === '--system' || a === '-s') {
            systemPrompt = args[++i] ?? systemPrompt;
        }
        else if (a === '--provider' || a === '-p') {
            provider = args[++i] ?? provider;
        }
        else if (a === '--device' || a === '-d') {
            device = args[++i] ?? device;
        }
        else if (a === '--help' || a === '-h') {
            usage();
            return;
        }
    }
    console.log(`Loading model "${model}" (this may take a while)...`);
    let session;
    try {
        session = await ChatSession.create(model, { token, systemPrompt, provider, device });
    }
    catch (err) {
        console.error('CLI error: Failed to load model:', err?.message ?? err);
        if (String(err?.message ?? '').toLowerCase().includes('unauthorized')) {
            console.error('Hint: this model may require a Hugging Face token. Set HF_TOKEN or pass `--token <token>`.');
        }
        if (String(err?.message ?? '').toLowerCase().includes('onnx')) {
            console.error('Hint: the chosen model does not expose ONNX artifacts. Try `--provider pt` (pytorch) or use a model with ONNX builds.');
        }
        process.exit(1);
    }
    console.log('Model loaded. Start chatting — type `exit` or `quit` to stop.');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });
    rl.prompt();
    rl.on('line', async (line) => {
        const text = String(line ?? '').trim();
        if (!text) {
            rl.prompt();
            return;
        }
        if (text === 'exit' || text === 'quit') {
            rl.close();
            return;
        }
        if (text === '/history') {
            console.log(JSON.stringify(session.history, null, 2));
            rl.prompt();
            return;
        }
        try {
            const reply = await session.send(text);
            console.log(reply);
        }
        catch (err) {
            console.error('Error during send():', err?.message ?? err);
        }
        rl.prompt();
    });
    rl.on('close', async () => {
        try {
            await session.destroy();
        }
        catch (err) { /* ignore */ }
        process.exit(0);
    });
}
main().catch((err) => {
    console.error('CLI error:', err);
    process.exit(1);
});
