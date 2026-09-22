/**
 * Edge for a Edge-Weighted Graph
 * Based on Algorithms, 4th Ed by Robert Sedgewick | Kevin Wayne
 */
public class Edge implements Comparable<Edge> {
    private int v;          //The first node on the edge
    private int w;          //The second node on the edge
    private double weight;  //The weight of the edge

    public Edge(int v, int w, double weight) {
        this.v = v;
        this.w = w;
        this.weight = weight;
    }

    public double weight() {
        return weight;
    }

    public int either() {
        return v;
    }

    public int other(int toCompare) {
        if (toCompare == v) {
            return w;
        } else {
            return v;
        }
    }

    //Compare two edges based on weight
    public int compareTo(Edge toCompare) {
        if (weight() < toCompare.weight()) {
            return -1;
        } else if (weight > toCompare.weight()) {
            return 1;
        } else {
            return 0;
        }
    }

    public String toString() {
        return String.format("%d-%d %.5f", v, w, weight);
    }

    public static void main (String[] args) {
        StdOut.println("Edge tester");
        Edge first = new Edge(17, 23, 42);

        StdOut.println(first);
        StdOut.println("First: " + first.either());     //17
        StdOut.println("Second: " + first.other(17));   //23
        StdOut.println("Weight: " + first.weight());    //42

        Edge second = new Edge(1,2,3);
        StdOut.println(first.compareTo(second));        //1
        StdOut.println(second.compareTo(first));        //-1

        Edge same = new Edge(1,2,42);
        StdOut.println(first.compareTo(same));           //0
    }
}
