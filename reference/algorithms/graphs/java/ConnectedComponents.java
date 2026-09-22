/**
 * Calculates the number of connected components on an Undirected Graph via Depth First Search
 * Based on Algorithms, 4th Ed by Robert Sedgewick | Kevin Wayne
 */
public class ConnectedComponents {
    private boolean[] marked; //To check vertices that have already been visited
    private int[] id; //The id of each CC
    private int count; //Number of CCs, also used to identify each one

    public ConnectedComponents(Graph G) {
        marked = new boolean[G.V()];
        id = new int[G.V()];

        //Cycle through graph and run a Depth First Search on any unvisited vertex, that constitutes a new CC
        for (int i = 0; i < G.V(); i++) {
            if (marked[i] == false) {
                dfs(G, i);
                count++;
            }
        }
    }

    //Mark each vertex adjacent to the given vertex and set the ID of the CC that it belongs to
    private void dfs(Graph G, int v) {
        marked[v] = true;
        id[v] = count;

        for (int i : G.adj(v)) {
            if (marked[i] == false) {
                dfs(G, i);
            }
        }
    }

    //Are first and second in the same component?
    public boolean connected(int first, int second) {
        return (id[first] == id[second]);
    }

    public int id(int vertex) {
        return id[vertex];
    }

    public int count() {
        return count;
    }
}
