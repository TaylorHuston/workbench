import calendar

def dayname(time):
  """Return the name of the day of the week for the given time."""
  return calendar.day_name[time.weekday()]

def greeting(time):
    """Return a greeting for the given time."""
    return f"Hello, world! Happy {dayname(time)}."