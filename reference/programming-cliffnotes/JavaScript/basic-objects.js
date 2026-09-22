// Objects

function objects() {
  // Create an object with object literal syntax.
  const person1 = {};

  // Dot notation for setting attributes.
  person1.name = "John Doe";

  // Properties with names that are not valid identifiers must use quotes.
  const person2 = {
    firstName: "Jane",
    "last name": "Doe",
    address: {
      street: "123 Main Street",
      city: "Your Town",
    },
  };

  console.log(person1.name);
  console.log(person2.firstName);
  console.log(person2["last name"]);

  // Object attributes can be other objects.
  const people = {};
  people.person1 = person1;

  // Bracket notation is useful when the property name is dynamic.
  people["person2"] = person2;

  console.log(people["person1"].name);
  console.log(people.person2.firstName);

  person1.name = "Jack Doe"; // Update attribute
  console.log(person1.name); // Jack Doe
  console.log(people.person1.name); // Jack Doe
  console.log("name" in person1); // true, checks own and inherited properties
  console.log(Object.hasOwn(person1, "name")); // true, checks only own properties
  console.log("age" in person1); // false
  delete person1.name; // Remove attribute
  console.log("name" in person1); // false

  console.log(Object.keys(person2)); // ['firstName', 'last name', 'address']
  console.log(Object.keys(people)); // ['person1', 'person2']
  console.log(Object.values(person2)); // ['Jane', 'Doe', { street: '123 Main Street', city: 'Your Town' }]
  console.log(Object.entries(person2)); // [['firstName', 'Jane'], ['last name', 'Doe'], ['address', {...}]]
  console.log(people.person2.address);

  // Object literals are the usual modern way to create plain objects.
  const phonebookEntry = {
    name: "Jack Huston",
    number: "860-555-1212",
    phone() {
      console.log(`Calling ${this.name} at ${this.number}...`);
    },
  };

  phonebookEntry.phone();

  // Methods can read or write other properties through this.
  const bob = {
    setAge(age) {
      this.age = age;
    },
  };
  bob.setAge(20);
  console.log(bob.age);

  function setWeight(weight) {
    this.weight = weight;
  }

  // Assign a function as an object method.
  bob.setWeight = setWeight;
  bob.setWeight(150);
  console.log(bob.weight);

  // Object equality compares identity, not matching contents.
  const object1 = {
    val: 10,
  };
  const object2 = object1;
  const object3 = {
    val: 10,
  };
  console.log(object1 === object2); // true, same object reference
  console.log(object1 === object3); // false, different object references
  object1.val = 15;
  console.log(object2.val); // 15

  // Bracket notation can use variables.
  const population = {};

  function addPop(city, pop) {
    population[city] = pop;
  }
  addPop("New York", "Eleventymillion");
  addPop("Chicago", "Seventeen Thousand");
  addPop("Seattle", 12);

  console.log(population["New York"]);

  // Object.entries() iterates over an object's own enumerable properties.
  for (const [city, pop] of Object.entries(population)) {
    console.log(`${city}: ${pop}`);
  }

  // Getters and setters look like properties but run functions.
  const thermostat = {
    celsius: 20,
    get fahrenheit() {
      return this.celsius * 9 / 5 + 32;
    },
    set fahrenheit(value) {
      this.celsius = (value - 32) * 5 / 9;
    },
  };
  console.log(thermostat.fahrenheit);
  thermostat.fahrenheit = 68;
  console.log(thermostat.celsius);

  // Add a getter or setter to an existing object.
  Object.defineProperty(thermostat, "kelvin", {
    get() {
      return this.celsius + 273.15;
    },
    set(value) {
      this.celsius = value - 273.15;
    },
  });
  console.log(thermostat.kelvin);
  thermostat.kelvin = 300;
  console.log(thermostat.celsius);

  // Primitives are passed by value.
  function passByValue(x) {
    x = 5;
  }
  const a = 10;
  passByValue(a);
  console.log(a); // 10

  // Object references are passed by value. A function can mutate the object
  // through that reference, but it cannot reassign the caller's variable.
  function mutateObject(obj) {
    obj.val = 5;
  }
  const myObj = {
    val: 10,
  };
  mutateObject(myObj);
  console.log(myObj.val); // 5

  function reassignObject(obj) {
    obj = { val: 99 };
  }
  reassignObject(myObj);
  console.log(myObj.val); // 5

  // Object with properties and methods.
  const chevy = {
    make: "Chevy",
    model: "Bel Air",
    year: 1957,
    color: "red",
    passengers: 2,
    convertible: false,
    mileage: 1021,
    started: false,
    start() {
      this.started = true;
    },
    stop() {
      this.started = false;
    },
    drive() {
      if (this.started) {
        console.log("Vroom, vroom!");
      } else {
        console.log("You need to start the car first.");
      }
    },
  };

  chevy.start();
  chevy.drive();

  // Loop through object properties.
  for (const [prop, value] of Object.entries(chevy)) {
    console.log(`${prop}: ${value}`);
  }

  // Object comparison by reference.
  const obj1 = { val: 1 };
  const obj2 = { val: 1 };
  const obj3 = obj1;
  console.log(obj1 === obj2); // false, different objects
  console.log(obj1 === obj3); // true, same reference
}

objects();
