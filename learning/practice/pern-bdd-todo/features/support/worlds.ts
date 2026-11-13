import { World, setWorldConstructor } from "@cucumber/cucumber";
import type { Browser, Page } from "playwright";

// Custom World for Cucumber scenarios, including browser and page instances
class MyWorld extends World {
  browser?: Browser;
  page?: Page;
}

setWorldConstructor(MyWorld);

export { MyWorld };
