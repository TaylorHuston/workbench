// Very basic example of making a faux server with ExpressJS

import express from "express";

const app = express();
const port = 9999;

const router = express.Router();

app.use(express.json());

let cars = [
  { id: 1, make: "Toyota", model: "Camry", year: 2020 },
  { id: 2, make: "Honda", model: "Civic", year: 2019 },
  { id: 3, make: "Ford", model: "Mustang", year: 2021 },
];

router.get("/", (req, res) => {
  res.json(cars);
});

router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const car = cars.find((car) => car.id === id);

  if (!car) {
    return res.status(404).json({ error: "Car not found" });
  }

  res.json(car);
});

router.post("/", (req, res) => {
  const { make, model, year } = req.body;
  const newCar = {
    id: cars.length + 1,
    make,
    model,
    year,
  };
  cars.push(newCar);
  res.status(201).json(newCar);
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const carIndex = cars.findIndex((car) => car.id === id);

  if (carIndex === -1) {
    return res.status(404).json({ error: "Car not found" });
  }

  const { make, model, year } = req.body;
  const updatedCar = { id, make, model, year };
  cars[carIndex] = updatedCar;
  res.json(updatedCar);
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const carIndex = cars.findIndex((car) => car.id === id);

  if (carIndex === -1) {
    return res.status(404).json({ error: "Car not found" });
  }

  cars.splice(carIndex, 1);
  res.status(204).end();
});

app.use("/api/v1/cars", router);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
