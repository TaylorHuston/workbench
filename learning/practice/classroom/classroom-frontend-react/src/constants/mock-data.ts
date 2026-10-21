import type { Subject } from "../types";

export const MOCK_SUBJECTS = [
  {
    id: 1,
    code: "MATH101",
    name: "Calculus I",
    department: "Mathematics",
    description: "Introduction to differential and integral calculus.",
  },
  {
    id: 2,
    code: "PHYS101",
    name: "Physics I",
    department: "Physics",
    description: "Fundamentals of mechanics and thermodynamics.",
  },
  {
    id: 3,
    code: "CHEM101",
    name: "Chemistry I",
    department: "Chemistry",
    description: "Basic concepts in general chemistry.",
  },
] satisfies Subject[];
