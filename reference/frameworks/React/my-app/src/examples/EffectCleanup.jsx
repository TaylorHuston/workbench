import { useEffect, useState } from "react";

// Effects can return a cleanup function. React runs that cleanup before the
// effect re-runs and when the component unmounts.

function Clock() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setSeconds((currentSeconds) => currentSeconds + 1);
    }, 1000);

    return () => {
      // Cleanup prevents the old interval from continuing after the component is
      // removed, and it also runs before this effect would set up a replacement.
      clearInterval(intervalId);
    };
  }, []);

  return <p>Seconds mounted: {seconds}</p>;
}

export default function EffectCleanup() {
  const [showClock, setShowClock] = useState(true);

  return (
    <section>
      <p>
        Toggle the clock on and off. Cleanup stops the interval when the clock is
        removed from the page.
      </p>

      <button type="button" onClick={() => setShowClock((currentShowClock) => !currentShowClock)}>
        {showClock ? "Hide clock" : "Show clock"}
      </button>

      {showClock ? <Clock /> : <p>The clock is unmounted.</p>}
    </section>
  );
}
