// React does not have a special template language for conditionals. You use
// ordinary JavaScript before the return, or JavaScript expressions inside JSX.

export default function Conditional() {
  const user = {
    name: "Taylor",
    isAdmin: true,
    unreadMessages: 3,
  };

  // Build a JSX value with a normal if statement. This is useful when the
  // branches are large or when naming the result makes the return easier to read.
  let dashboardLink;
  if (user.isAdmin) {
    dashboardLink = <a href="/admin">Admin dashboard</a>;
  } else {
    dashboardLink = <a href="/account">Account dashboard</a>;
  }

  return (
    <section>
      <h3>Welcome, {user.name}</h3>

      <p>{dashboardLink}</p>

      {/* A ternary is good for choosing between two small pieces of UI inline. */}
      <p>{user.isAdmin ? "You can manage site settings." : "You can manage your account."}</p>

      {/* && is good for showing something only when the condition is true. */}
      {user.unreadMessages > 0 && (
        <p>You have {user.unreadMessages} unread messages.</p>
      )}

      {/* Returning null from a component, or placing null in JSX, renders nothing. */}
      {user.isAdmin ? null : <p>Ask an admin if you need more access.</p>}
    </section>
  );
}
