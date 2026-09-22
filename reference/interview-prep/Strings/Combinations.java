package Strings;

/*Print all possible combinations of a string*/
public class Combinations {

    private String someString;
    StringBuilder out = new StringBuilder();

    public Combinations(String someString) {
        this.someString = someString;
        printCombination(0);
    }

    public void printCombination(int i) {
        for (int j = i; j < someString.length(); j++) {

            out.append(someString.charAt(j));
            System.out.println(out);

            printCombination(j+1);

            out.setLength(out.length()-1);
        }
    }

    public static void main(String[] args) {
        Combinations comb = new Combinations("wxyz");
    }
}
