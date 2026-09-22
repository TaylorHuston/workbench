let chevy = {
    make: "Chevy",
    model: "Bel Air",
    year: 1957,
    color: "red",
    passengers: 2,
    convertible: false,
    mileage: 1021,
    started: false,
    start () {
        this.started = true;
    },
    stop() {
        this.started = false;
    },
    drive() {
        if (this.started) {
            alert("Vroom, vroom!");
        } else {
            alert("You need to start the car first.");
        }
    }
}

console.log(chevy);
console.log(chevy.make);

chevy.mileage += 100;

console.log(chevy.mileage);

chevy.tires = "new";

console.log(chevy.tires);

delete chevy.tires;

console.log(chevy.tires); // undefined

for (let prop in chevy) {
    console.log(prop + ": " + chevy[prop]);
}

let taxi = {
    make: "Webville Motors",
    model: "Taxi",
    year: 1955,
    color: "yellow",
    passengers: 4,
    convertible: false,
    mileage: 281341
}

function prequal(car) {
    if (car.mileage > 10000) {
        return false;
    } else if (car.year > 1960) {
        return false;
    }
    return true;
}

let worthALook = prequal(taxi);

if (worthALook) {
    console.log("You gotta check out this " + taxi.make + " " + taxi.model);
} else {
    console.log("You should really pass on the " + taxi.make + " " + taxi.model);
}




