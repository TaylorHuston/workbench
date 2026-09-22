/**
 * Calculates the number of strongly connected components on an Directed Graph via Depth First Search
 * Based on Algorithms, 4th Ed by Robert Sedgewick | Kevin Wayne
 */
public class KosarajuSharirSCC {
    private boolean[] marked;   //To check vertices that have already been visited
    private int[] id;           //The id of each CC
    private int count;          //Number of CCs, also used to identify each one

    KosarajuSharirSCC(Digraph G) {
        marked  = new boolean[G.V()];
        id      = new int[G.V()];

        //Sort the reverse of the graph
        DepthOrder sorted = new DepthOrder(G.reverse());

        //Perform a DFS on the reverse postorder of the reverse of the graph to build each SCC
        for (int source : sorted.reversePost()) {
            if (marked[source] == false) {
                dfs(G, source);
                count++;
            }
        }

    }

    //Depth First Search
    private void dfs(Digraph G, int source) {
        marked[source]  = true;     //This vertex has been visited
        id[source]      = count;    //The SCC this vertex belongs to

        for (int next : G.adj(source)) {
            if (marked[next] == false) {
                dfs(G, next);
            }
        }
    }

    //Are these two vertices in the same SCC
    boolean stronglyConnected(int first, int second) {
        return (id[first] == id[second]);
    }

    int count() {
        return count;
    }

    int id(int v) {
        return id[v];
    }
}
