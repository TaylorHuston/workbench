package Strings;

import java.util.HashSet;

/*Remove any characters from string that are in remove*/
public class Remove {

    public static String remove(String string, String toRemove) {
        char[] s = string.toCharArray();
        char[] r = toRemove.toCharArray();
        HashSet<Character> rhash = new HashSet<>();

        for (int i = 0; i < r.length; i++) {
            rhash.add(r[i]);
        }

        int end = 0;

        for (int start = 0; start < s.length; start++) {
            if (!rhash.contains(s[start])) {
                s[end] = s[start];
                end++;
            }
        }

        return new String(s, 0, end);
    }

    public static void main(String[] args) {
        System.out.println(Remove.remove("Taylor Huston is a boss", "aeiou"));
    }
}
