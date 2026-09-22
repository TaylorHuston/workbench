package BigO;

/*Calculates all the permutations of a string. O(N!) */
public class StringPerumtation {

    public static void permutation(String str) {
        permutation(str, "");
    }

    public static void permutation(String str, String pre) {
        if (str.length() == 0) {
            System.out.println(pre);
        } else {
            for (int i = 0; i < str.length(); i++) {
                String rem = str.substring(0, i) + str.substring(i + 1);
                permutation(rem, pre + str.charAt(i));
            }
        }
    }

    public static void main(String[] args) {
        StringPerumtation.permutation(args[0]);
    }
}
