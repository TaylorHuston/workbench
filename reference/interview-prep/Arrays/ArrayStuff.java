package Arrays;

/*Various array related functions, from Chapter 1*/
public class ArrayStuff {

    //Rotate all of the clauses in an NxN matrix 90 degrees
    public static void rotateMatrix(int[][] M, int N) {
        for (int layer = 0; layer < N / 2; layer++) {
            for (int offset = 0; offset < N - 2; offset++) {
                int save = M[offset][layer];
                M[offset][layer] = M[layer][N - 1 - offset];
                M[layer][N - 1 - offset] = M[N - 1 - offset][N - 1 - layer];
                M[N - 1 - offset][N - 1 - layer] = M[N - 1 - layer][offset];
                M[N - 1 - layer][offset] = save;
            }
        }

    }

    public static void nullRows(int[][] M, int N) {
        boolean[] row = new boolean[N];
        boolean[] col = new boolean[N];

        for (int y = 0; y < N; y++) {
            for (int x = 0; x < N; x++) {
                if (M[x][y] == 0) {
                    row[y] = true;
                    col[x] = true;
                }
            }
        }

        for (int y = 0; y < N; y++) {
            if (row[y] == true) {
                for (int x = 0; x < N; x++) {
                    M[x][y] = 0;
                }
            }
        }

        for (int y = 0; y < N; y++) {
            if (col[y] == true) {
                for (int x = 0; x < N; x++) {
                    M[y][x] = 0;
                }
            }
        }
    }

    public static void main(String[] args) {
        int[][] matrix = new int[4][4];
        int count = 1;
        for (int y = 0; y < 4; y++) {
            for (int x = 0; x < 4; x++) {
                matrix[x][y] = count++;
            }
        }

        for (int y = 0; y < 4; y++) {
            for (int x = 0; x < 4; x++) {
                System.out.print(matrix[x][y] + " ");
            }
            System.out.println();
        }

        ArrayStuff.rotateMatrix(matrix, 4);

        System.out.println();

        for (int y = 0; y < 4; y++) {
            for (int x = 0; x < 4; x++) {
                System.out.print(matrix[x][y] + " ");
            }
            System.out.println();
        }

        System.out.println();

        matrix[0][1] = 0;
        matrix[2][2] = 0;

        for (int y = 0; y < 4; y++) {
            for (int x = 0; x < 4; x++) {
                System.out.print(matrix[x][y] + " ");
            }
            System.out.println();
        }

        System.out.println();

        ArrayStuff.nullRows(matrix, 4);

        for (int y = 0; y < 4; y++) {
            for (int x = 0; x < 4; x++) {
                System.out.print(matrix[x][y] + " ");
            }
            System.out.println();
        }

    }


}
