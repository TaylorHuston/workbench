import { MOCK_SUBJECTS } from "../constants/mock-data";

const getSubjects = async () => {
  return MOCK_SUBJECTS;
  //throw new Error("Failed to fetch subjects");
};

export default getSubjects;
