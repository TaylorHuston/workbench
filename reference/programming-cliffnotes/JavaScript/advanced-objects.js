// Advanced objects, prototypes, classes, and inheritance

function advancedObjects() {
  // JavaScript objects can delegate property lookups to a prototype object.
  const animalPrototype = {
    speak() {
      console.log(`${this.name} makes a sound.`);
    },
  };

  const dog = Object.create(animalPrototype);
  dog.name = "Rover";
  dog.speak();

  console.log(Object.getPrototypeOf(dog) === animalPrototype); // true
  console.log(Object.hasOwn(dog, "name")); // true
  console.log(Object.hasOwn(dog, "speak")); // false, speak is on the prototype

  // Constructor functions are the older way to create multiple similar objects.
  function Person(name) {
    this.name = name;
  }

  // Methods on the prototype are shared by all instances.
  Person.prototype.sayName = function () {
    console.log(this.name);
  };

  const bob = new Person("Bob");
  bob.sayName();

  console.log(Object.getPrototypeOf(bob) === Person.prototype); // true
  console.log(bob instanceof Person); // true

  // class syntax is the modern, common way to write constructor/prototype code.
  // It is still based on prototypes under the hood.
  class Player {
    #score = 0;

    constructor(name) {
      this.name = name;
    }

    addPoint() {
      this.#score += 1;
    }

    describe() {
      console.log(`${this.name} has ${this.#score} point(s).`);
    }
  }

  const taylor = new Player("Taylor");
  taylor.addPoint();
  taylor.describe();

  // Private class fields, like #score, cannot be accessed outside the class.
  // console.log(taylor.#score); // SyntaxError

  // extends sets up prototype inheritance between classes.
  class Employee extends Player {
    constructor(name, role) {
      super(name);
      this.role = role;
    }

    describeRole() {
      console.log(`${this.name} works as a ${this.role}.`);
    }
  }

  const employee = new Employee("Alex", "developer");
  employee.addPoint();
  employee.describe();
  employee.describeRole();

  console.log(employee instanceof Employee); // true
  console.log(employee instanceof Player); // true
}

advancedObjects();
