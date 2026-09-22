/**
 * Use Depth First Search to determine if a directed graph contains any cycles
 * Based on Algorithms, 4th Ed by Robert Sedgewick | Kevin Wayne
 */
public class DirectedCycle {
    private boolean[] marked;       //Keep track of already visited vertices
    private int[] edgeTo;           //Last vertex on known path to this vertex
    private Stack<Integer> cycle;   //Vertices on a cycle (if cycle exists)
    private boolean[] onStack;      //Vertices on current path

    public DirectedCycle(Digraph G) {
        onStack = new boolean[G.V()];
        marked = new boolean[G.V()];
        edgeTo = new int[G.V()];

        //Cycle through each vertex to see if it is in a cycle
        for (int v = 0; v < G.V(); v++) {
            if (marked[v] == false) {
                dfs(G, v);
            }
        }
    }

    //Recursively traverse each path until you reach a 'dead end'
    private void dfs(Digraph G, int current) {
        onStack[current] = true;
        marked[current] = true;
        for (int next : G.adj(current)) {
            //At least one cycle has already been found
            if (cycle != null) {
                return;
            } else if (marked[next] == false) { //The next vertex hasn't been visited
                edgeTo[next] = current;
                dfs(G, next);
            } else if (onStack[next] == true) { //The next vertex has already been visited in this path
                cycle = new Stack<Integer>();
                //Traverse backwards through current stack and add to cycle stack
                for (int i = current; i != next; i = edgeTo[i]) {
                    cycle.push(i);
                }
                cycle.push(next);
                cycle.push(current);
            }
        }
        onStack[current] = false;
    }

    public boolean hasCycle() {
        return cycle != null;
    }

    public Iterable<Integer> cycle() {
        return cycle;
    }

}
