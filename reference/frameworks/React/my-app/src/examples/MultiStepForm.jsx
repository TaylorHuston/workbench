import { useState } from "react";

// Multi-step forms are a good example of parent-coordinated state. Each step is
// its own component, but the parent owns the full draft so moving forward and
// backward does not lose any data.

function AccountStep({ values, onFieldChange }) {
  return (
    <>
      <label>
        Email
        <input
          type="email"
          value={values.email}
          onChange={(event) => onFieldChange("email", event.target.value)}
          placeholder="name@example.com"
        />
      </label>

      <label>
        Password
        <input
          type="password"
          value={values.password}
          onChange={(event) => onFieldChange("password", event.target.value)}
          placeholder="Create a password"
        />
      </label>
    </>
  );
}

function ProfileStep({ values, onFieldChange }) {
  return (
    <>
      <label>
        Display name
        <input
          type="text"
          value={values.displayName}
          onChange={(event) => onFieldChange("displayName", event.target.value)}
          placeholder="Taylor"
        />
      </label>

      <label>
        Role
        <select value={values.role} onChange={(event) => onFieldChange("role", event.target.value)}>
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
          <option value="mentor">Mentor</option>
        </select>
      </label>
    </>
  );
}

function ReviewStep({ values }) {
  return (
    <div>
      <p><strong>Email:</strong> {values.email || "Not provided yet"}</p>
      <p><strong>Password:</strong> {values.password ? "Saved in draft" : "Not provided yet"}</p>
      <p><strong>Display name:</strong> {values.displayName || "Not provided yet"}</p>
      <p><strong>Role:</strong> {values.role}</p>
    </div>
  );
}

const steps = [
  { title: "Account", component: AccountStep },
  { title: "Profile", component: ProfileStep },
  { title: "Review", component: ReviewStep },
];

export default function MultiStepForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [values, setValues] = useState({
    email: "",
    password: "",
    displayName: "",
    role: "student",
  });
  const [submitted, setSubmitted] = useState(false);

  // This step list and dynamic component lookup are just scaffolding for the
  // demo. The real lesson is that one parent keeps the whole draft while child
  // step components edit that shared draft.
  const CurrentStep = steps[currentStep].component;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  function handleFieldChange(field, value) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  }

  function goToNextStep() {
    setCurrentStep((step) => step + 1);
  }

  function goToPreviousStep() {
    setCurrentStep((step) => step - 1);
  }

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <section>
      <p>
        The parent coordinates the whole workflow: which step is active, what the
        current draft values are, and when the wizard is finished.
      </p>

      <p>
        For simplicity, each step receives the full draft object here, but the
        source of truth still stays in one parent state object.
      </p>

      <form onSubmit={handleSubmit}>
        <p>
          Step {currentStep + 1} of {steps.length}: <strong>{steps[currentStep].title}</strong>
        </p>

        <CurrentStep values={values} onFieldChange={handleFieldChange} />

        <div>
          <button type="button" onClick={goToPreviousStep} disabled={isFirstStep}>
            Back
          </button>

          {isLastStep ? (
            <button type="submit">Finish</button>
          ) : (
            <button type="button" onClick={goToNextStep}>
              Next
            </button>
          )}
        </div>
      </form>

      {submitted ? <p>The parent now has the complete draft from every step.</p> : null}
    </section>
  );
}
