package Recursive;

import java.util.Arrays;

/*A child can run up the stairs taking either 1, 2 or 3 steps at a time. What is the possible number of ways
a child can run up n steps?
 */
public class NumSteps {

    /*The child can get to n step by jumping either 1, 2 or 3 steps. Essentially jumping from n-1, n-2 or n-3.
    So that's 3 ways, plus how many steps it took to get to n-1, n-2, n-3. Base case is you are on the last step.*/
    public static int countWays(int n) {
        int[] memo = new int[n + 1];
        Arrays.fill(memo, -1);
        return countWays(n, memo);
    }

    private static int countWays(int n, int[] memo) {
        if (n < 0) {
            return 0;
        } else if (n == 0) {
            return 1;
        } else if (memo[n] > -1) {
            return memo[n];
        } else {
            memo[n] = countWays(n - 1, memo) + countWays(n - 2, memo) + countWays(n - 3, memo);
            return memo[n];
        }
    }

    public static void main(String[] args) {
        System.out.println(NumSteps.countWays(5));
    }
}
