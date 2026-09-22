// Date object syntax

function dateExamples() {
  const today = new Date(); // Current date and time

  console.log(today);
  console.log(today.toISOString()); // Portable UTC timestamp

  const y2k = new Date(2000, 0, 1); // Months are 0-indexed; this uses local time
  const y2kUtc = new Date(Date.UTC(2000, 0, 1)); // UTC version of the same date

  // Dates have a range of self-explanatory methods
  console.log(y2k.getMonth());
  console.log(y2k.getDate()); // Day of month (1-31)
  console.log(y2k.getDay()); // Day of week (0-6)
  console.log(y2k.getFullYear());
  console.log(y2k.getTime()); // Milliseconds since 1970-01-01T00:00:00.000Z
  console.log(y2kUtc.toISOString());

  // Setter methods mutate the existing Date object.
  const changedDate = new Date(today);
  changedDate.setMonth(5); // Can set the values individually
  console.log(changedDate);

  // Use Intl.DateTimeFormat for user-facing date strings.
  const formatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });
  console.log(formatter.format(today));

  const date1 = new Date(2000, 0, 1);
  const date2 = new Date(2000, 0, 1);

  console.log(date1 === date2); // false, two different objects
  console.log(date1.getTime() === date2.getTime()); // true, same timestamp

  // For new date/time-heavy code, watch the Temporal API or use a library/polyfill.
}

dateExamples();
