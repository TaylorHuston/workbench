import { Given, When, Then } from "@cucumber/cucumber";
import type { MyWorld } from "../support/worlds.js";

Given("my todo list is empty", async function (this: MyWorld) {
  if (this.page) {
    await this.page.goto("http://localhost:5173");
  } else {
    throw new Error("Page is not initialized");
  }
  // Write code here that turns the phrase above into concrete actions
  return "pending";
});
