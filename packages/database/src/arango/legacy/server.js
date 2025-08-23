import express from 'express';

const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('Agent Coder API is running!'));

app.listen(5001, () => console.log('Agent Coder running on port 5001'));
