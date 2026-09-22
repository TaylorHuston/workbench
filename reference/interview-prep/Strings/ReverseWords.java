package Strings;

/*Reverse the words in a string*/
public class ReverseWords {

    public static String Reverse(String string) {
        char[] s = string.toCharArray();
        reverseChars(s, 0, s.length-1);

        int start = 0;
        int end = 0;

        while (end < s.length) {
            if (s[end] == ' ') {
                reverseChars(s, start, end-1);
                end++;
                start = end;
            } else {
                end++;
            }

        }

        return new String(s);
    }

    private static void reverseChars(char[] s, int start, int end) {
        char temp;

        while (start < end) {
            temp = s[start];
            s[start] = s[end];
            s[end] = temp;
            start++;
            end--;
        }
    }

    public static void main(String[] args) {
        String s = "I am a string hear me roar";
        System.out.println(Reverse(s));
    }
}
