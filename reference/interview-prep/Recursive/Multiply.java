package Recursive;

/*Recusrively multiply two numbers without actually using the * operator*/
public class Multiply {

    public static int multiply(int x, int y) {
        return multiply(0, x, y);
    }

    private static int multiply(int sum, int x, int y) {
        if (y > 0) {
            sum = multiply(sum, x, y - 1);
        }
        if (y == 0) {
            return 0;
        } else {
            sum += x;
        }
        return sum;
    }

    public static void main(String[] args) {
        System.out.println(Multiply.multiply(5, 3));
        System.out.println(Multiply.multiply(10, 19));
    }
}
