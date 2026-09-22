def reverse(string):
    """Reverses a string."""
    return "".join(reversed(string))

def ispalindrome(string):
    """Returns True if string is a palindrome."""
    processed_string = string.lower()
    return processed_string == reverse(processed_string)