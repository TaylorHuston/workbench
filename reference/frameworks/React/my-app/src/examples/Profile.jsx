// This file is the first example in the learning path. It introduces JSX: the
// JavaScript syntax React uses to describe UI. JSX looks like HTML, but it is
// still JavaScript and can use JavaScript values inside `{}`.

const user = {
  name: "Hedy Lamarr",
  imageUrl: "https://i.imgur.com/yXOvdOSs.jpg",
  imageSize: 90,
  profession: "Inventor and actor",
};

// A React component is a JavaScript function that returns UI.
// Component names must start with a capital letter so React treats them as
// custom components instead of built-in HTML tags.
export default function Profile() {
  const heading = `${user.name}'s profile`;

  return (
    // A component must return one parent value. A Fragment (`<>...</>`) groups
    // sibling elements without adding an extra wrapper element to the DOM, though
    // you could also use a <div> or any other element if you prefer.
    <>
      {/* Curly braces let JSX read JavaScript expressions. */}
      <h1>{heading}</h1>

      <p>{user.profession}</p>

      <img
        // JSX uses className instead of class because class is a JavaScript keyword.
        className="avatar"

        // Attribute values can also come from JavaScript expressions.
        src={user.imageUrl}
        alt={`Photo of ${user.name}`}

        // The style prop accepts a JavaScript object, not a CSS string.
        // CSS property names use camelCase, so `object-fit` becomes `objectFit`.
        style={{
          width: user.imageSize,
          height: user.imageSize,
          objectFit: "cover",
          borderRadius: "999px",
        }}
      />

      <p>
        This UI is described by JSX, but the data above is plain JavaScript.
      </p>
    </>
  );
}
