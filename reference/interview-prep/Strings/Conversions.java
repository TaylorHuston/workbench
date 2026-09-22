package Strings;

/*Convert an integer to a string and vice-versa*/
public class Conversions {

    public static int toInt(String someString) {
        int result = 0;
        char[] arr = someString.toCharArray();

        for (int i = 0; i < arr.length; i++) {
            result *= 10;
            result += arr[i] - '0';
        }

        return result;
    }

    public static String toString(int someInt) {
        StringBuilder SB = new StringBuilder();

        while (someInt != 0) {
            SB.append( (char) someInt % 10);
            someInt /= 10;
        }

        SB.reverse();

        return new String(SB);
    }

    public static void main(String[] args) {
        int result = Conversions.toInt("123");
        System.out.println(result);
        String sresult = Conversions.toString(738);
        System.out.println(sresult);
    }
}
