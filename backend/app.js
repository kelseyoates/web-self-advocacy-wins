const express = require('express');
const stripeRoutes = require('./routes/stripe');

const app = express();
const port = process.env.PORT || 3000;

app.use('/stripe', stripeRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 