/**
 * Breadth First search of a graph
 * Based on Algorithms, 4th Ed by Robert Sedgewick | Kevin Wayne
 */
public class BreadthFirst {
    private boolean[] marked; //Is a shortest path to this vertex known?
    private int[] edgeTo; //Last vertex on known path to this vertex
    private final int source; //Source vertex

    public BreadthFirst(Graph G, int source) {
        marked = new boolean[G.V()];
        edgeTo = new int[G.V()];
        this.source = source;
        bfs(G, source);
    }

    //Find the shortest path to the vertex toFind from the source
    private void bfs(Graph G, int toFind) {
        //Mark source and put it on the queue
        Queue<Integer> queue = new Queue<Integer>();
        marked[source] = true;
        queue.enqueue(source);

        //Grab the next vertex on the queue, and mark any unmarked adjacent vertices
        while (queue.isEmpty() == false) {
            int last = queue.dequeue();
            for (int i : G.adj(last)) {
                if (marked[i] == false) {
                    edgeTo[i] = last; //Last edge on shortest path
                    marked[i] = true;
                    queue.enqueue(i);
                }
            }
        }
    }

    public boolean hasPathTo(int v) {
        return marked[v];
    }

    //Return the path from the source to vertex v
    public Iterable<Integer> pathTo(int v) {
        if (hasPathTo(v) == false) {
            return null;
        }
        Queue<Integer> path = new Queue<Integer>();
        for (int i = v; i != source; i = edgeTo[i]) {
            path.enqueue(i);
        }
        path.enqueue(source);
        return path;
    }

}
