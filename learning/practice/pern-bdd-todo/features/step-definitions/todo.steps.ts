import { Given, When, Then } from "@cucumber/cucumber";
import type { MyWorld } from "../support/worlds.js";
import assert from "node:assert/strict";

Given("my todo list is empty", async function (this: MyWorld) {
  if (this.page) {
    await this.page.goto("http://localhost:5173");
  } else {
    throw new Error("Page is not initialized");
  }
  // Write code here that turns the phrase above into concrete actions
  return "pending";
});

When("I add {string}", async function (this: MyWorld, title: string) {
  if (this.page) {
    await this.page.getByLabel("Task").fill(title);
    await this.page.getByRole("button", { name: "Add task" }).click();
  } else {
    throw new Error("Page is not initialized");
  }
});

Then("I see {string} as incomplete", async function (this: MyWorld, title: string) {
  if (this.page) {
    const checkbox = this.page.getByRole("checkbox", { name: title });
    await checkbox.waitFor({ state: "visible" });
    assert.equal(await checkbox.isChecked(), false);
  } else {
    throw new Error("Page is not initialized");
  }
});

When("I reload the page", async function (this: MyWorld) {
  if (this.page) {
    await this.page.reload();
  } else {
    throw new Error("Page is not initialized");
  }
});

When("I add a blank task", async function (this: MyWorld) {
  if (this.page) {
    await this.page.getByRole("button", { name: "Add task" }).click();
  } else {
    throw new Error("Page is not initialized");
  }
  return "pending";
});

Then("I see {string}", async function (this: MyWorld, title: string) {
  if (this.page) {
    await this.page.getByText(title).isVisible();
  } else {
    throw new Error("Page is not initialized");
  }
  return "pending";
});
