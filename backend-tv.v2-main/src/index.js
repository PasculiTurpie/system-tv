require("dotenv").config();

const app = require("./app");
const { connectMongoose } = require("./config/config.mongoose");

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    await connectMongoose();

    app.listen(PORT);
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

bootstrap();
