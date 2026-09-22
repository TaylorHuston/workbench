package BigO;


public class Fibonacci {

    /*Compute the nth fibonacci number. O(2^n) runtime*/
    public static int computeNth(int n) {
        if (n <= 0) {
            return 0;
        } else if (n == 1) {
            return 1;
        }
        return computeNth(n - 1) + computeNth(n - 2);
    }

    /*Computer all of the fib#'s up to n, caches already found choices. O(N)*/
    public static void computeAll(int n) {
        int[] memo = new int[n + 1];
        for (int i = 0; i < n; i++) {
            System.out.println(i + ": " + fib(i, memo));
        }
    }

    public static int fib(int n, int[] memo) {
        if (n <= 0) {
            return 0;
        } else if (n == 1) {
            return 1;
        } else if (memo[n] > 0) {
            return memo[n];
        }
        memo[n] = fib(n - 1, memo) + fib(n - 2, memo);
        return memo[n];
    }

    public static void main(String[] args) {
        int n = Integer.parseInt(args[0]);
        int result = Fibonacci.computeNth(n);
        System.out.println("The " + n + "th Fibonaci number is " + result);
        System.out.println("The first " + n + " Fibonaci numbers are:");
        Fibonacci.computeAll(n + 1);
    }

}
