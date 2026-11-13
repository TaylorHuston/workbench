import { Before, After } from "@cucumber/cucumber";
import { chromium } from "playwright";
import type { MyWorld } from "./worlds.js";

// This is Cucumber "asking" for a new browser and page before each scenario
// Cucumber uses this to set up the browser and page for each scenario to run the tests in browser-side isolation
Before(async function (this: MyWorld) {
  console.log("Before scenario");
  this.browser = await chromium.launch();
  this.page = await this.browser.newPage();
});

// This is Cucumber "asking" to clean up the browser and page after each scenario
After(async function (this: MyWorld) {
  console.log("After scenario");
  if (this.page) {
    await this.page.close();
  }
  if (this.browser) {
    await this.browser.close();
  }
});
