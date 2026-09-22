package Strings;

import java.util.Arrays;

/*Various string related functions, from Chapter 1*/
public class StringStuff {

    public static String sort(String toSort) {
        char[] content = toSort.toCharArray();
        Arrays.sort(content);
        return new String(content);
    }

    /*Check to see if a string is all unique characters without using adtl. data structures*/
    public static boolean isUniqueChars(String toTest) {
        if (toTest.length() > 128) { //Extended ASCII
            return false;
        }
        boolean[] char_set = new boolean[128];

        for (int i = 0; i < toTest.length(); i++) {
            int val = (int) toTest.charAt(i);
            if (char_set[val]) { //Character has already been found in string
                return false;
            }
            char_set[val] = true;
        }
        return true;
    }

    /*Given two strings, determine if one is a permutation of the other using a sort.*/
    public static boolean isPermutationSort(String s, String t) {
        if (s.length() != t.length()) {
            return false;
        }
        return sort(s).equals(sort(t));
    }

    /*Given two strings, determine if on is a permutation of the other by comparing character counts.*/
    public static boolean isPermutationNoSort(String s, String t) {
        if (s.length() != t.length()) {
            return false;
        }

        int[] letters = new int[128]; //Extended ASCII

        char[] s_array = s.toCharArray();
        for (char c : s_array) {
            letters[c]++;
        }

        for (int i = 0; i < t.length(); i++) {
            int val = (int) t.charAt(i);
            letters[val]--;
            if (letters[val] < 0) {
                return false;
            }
        }
        return true;
    }

    public static String URLify(String str) {
        char[] strArray = str.toCharArray();
        System.out.println(strArray);

        int length = strArray.length;
        int newLength = 0;

        for (int i = 0; i < strArray.length; i++) {
            if (strArray[i] == ' ') {
                newLength += 3;
            } else {
                newLength++;
            }
        }

        char[] toReturn = new char[newLength + 1];
        toReturn[newLength] = '\0';
        for (int i = length - 1; i >= 0; i--) {
            if (strArray[i] == ' ') {
                toReturn[newLength - 1] = '0';
                toReturn[newLength - 2] = '2';
                toReturn[newLength - 3] = '%';
                newLength -= 3;
            } else {
                toReturn[newLength - 1] = strArray[i];
                newLength--;
            }
        }

        return new String(toReturn);
    }

    /*Are any of the permutations of the given string a palindrome?*/
    public static boolean isPalindromePermutation(String s) {
        int countOdd = 0;

        int[] numChars = new int[26]; //Assuming only letters and spaces

        for (char c : s.toLowerCase().toCharArray()) {
            if (c == ' ') {
                continue;
            } else {
                int x = ((int) c) % 26;
                numChars[x]++;
                if (numChars[x] % 2 == 1) {
                    countOdd++;
                } else {
                    countOdd--;
                }
            }
        }

        return (countOdd < 2);
    }

    /* Are two strings one operation (insert, remove or replace a char) different?*/
    public static boolean oneAway(String s, String t) {
        if (s.length() == t.length()) {
            return oneEditReplace(s, t);
        } else if (s.length() + 1 == t.length()) {
            return oneEditInsert(s, t);
        } else if (t.length() + 1 == s.length()) {
            return oneEditInsert(t, s);
        }
        return false;
    }

    public static boolean oneEditReplace(String s, String t) {
        int diff = 0;

        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) != t.charAt(i)) {
                diff++;
            }
        }
        return (diff < 2);
    }

    public static boolean oneEditInsert(String s, String t) {
        int index1 = 0;
        int index2 = 0;
        int diff = 0;

        while (index1 < s.length() && index2 < t.length()) {
            if (s.charAt(index1) != t.charAt(index2)) {
                diff++;
                index2++;
            } else {
                index1++;
                index2++;
            }
        }

        return (diff < 2);
    }

    /*Compress all of the duplicate chars in a row*/
    public static String compressString(String s) {
        StringBuilder compressed = new StringBuilder();
        int consecutive = 1;

        for (int i = 0; i < s.length(); i++) {
            if ((i + 1) == s.length() || s.charAt(i) != s.charAt(i + 1)) {
                compressed.append(s.charAt(i));
                compressed.append(consecutive);
                consecutive = 1;
            } else {
                consecutive++;
            }
        }

        return compressed.toString();
    }


    public static void main(String[] args) {
        System.out.println(StringStuff.isUniqueChars("abcde"));
        System.out.println(StringStuff.isUniqueChars("abcbe"));
        System.out.println(StringStuff.isPermutationSort("abcbe", "bacbe"));
        System.out.println(StringStuff.isPermutationNoSort("abcbe", "bacbe"));
        System.out.println(StringStuff.isPermutationSort("abcbe", "dacbe"));
        System.out.println(StringStuff.isPermutationNoSort("abcbe", "dacbe"));
        System.out.println(StringStuff.URLify("Mr John Smith"));
        System.out.println(StringStuff.isPalindromePermutation("Tact Coa"));
        System.out.println(StringStuff.isPalindromePermutation("TactCoa"));
        System.out.println(StringStuff.isPalindromePermutation("Tact Coaa"));
        System.out.println(StringStuff.oneAway("Apple", "Aple"));
        System.out.println(StringStuff.oneAway("Aple", "Apple"));
        System.out.println(StringStuff.oneAway("ApPle", "Apple"));
        System.out.println(StringStuff.oneAway("AQle", "Apple"));
        System.out.println(StringStuff.compressString("aaabccddef"));
        System.out.println(StringStuff.compressString("aaabccddeff"));
    }
}
