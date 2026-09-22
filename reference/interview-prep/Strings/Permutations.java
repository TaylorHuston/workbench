package Strings;

/*Print all permutations of a string*/
public class Permutations {

    public Permutations(String someString) {
        StringBuilder rem = new StringBuilder();
        rem.append(someString);
        printPermutations(new StringBuilder(), rem);
    }

    public void printPermutations(StringBuilder pre, StringBuilder rem) {
        if (rem.length() == 0) {
            System.out.println(pre);
        }

        for (int i = 0; i < rem.length(); i++ ) {
            StringBuilder temp = new StringBuilder();
            temp.append(pre);
            temp.append(rem.charAt(i));
            StringBuilder ptemp = new StringBuilder();
            ptemp.append(rem);
            ptemp.deleteCharAt(i);
            printPermutations(temp, ptemp);
        }
    }

    public static void main(String[] args) {
        Permutations perm = new Permutations("abc");
    }
}
