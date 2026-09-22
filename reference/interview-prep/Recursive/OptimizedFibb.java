package Recursive;

/*Optimized Fibonacci*/
public class OptimizedFibb {
    int[] memo; //Cache fib results

    public static int calcFib(int n) {
        return calcFib(n, new int[n + 1]);
    }

    private static int calcFib(int i, int[] memo) {
        if (i == 0 || i == 1) {
            return 1;
        }

        if (memo[i] == 0) {
            memo[i] = (calcFib(i - 1, memo) + calcFib(i - 2, memo));
        }

        return memo[i];
    }

    public static void main(String[] args) {
        System.out.println(OptimizedFibb.calcFib(0));
        System.out.println(OptimizedFibb.calcFib(1));
        System.out.println(OptimizedFibb.calcFib(5));
        System.out.println(OptimizedFibb.calcFib(10));
    }
}
