package Graphs;


import StacksAndQueues.Queue;

import java.util.ArrayList;

/*Graph with BFS and DFS search methods*/
public class Graph {

    ArrayList<Integer>[] nodes;
    int count = 0;
    int size;

    public Graph(int size) {
        this.size = size;
        nodes = new ArrayList[size];
        for (int i = 0; i < size; i++) {
            nodes[i] = new ArrayList<>();
        }
    }

    public void addEdge(int v, int y) {
        nodes[v].add(y);
    }

    public boolean hasPathToBFS(int v, int y) {
        boolean[] visited = new boolean[size];
        Queue<Integer> toVisit = new Queue<>();
        toVisit.enqueue(v);

        while (toVisit.isEmpty() != true) {
            Integer check = toVisit.dequeue();
            visited[v] = true;
            for (Integer i : nodes[check]) {
                if (i == y) {
                    return true;
                }
                if (visited[i] == false) {
                    toVisit.enqueue(i);
                }
            }
        }

        return false;
    }

    public boolean hasPathToDFS(int v, int y) {
        boolean[] visited = new boolean[size];
        DFS(v, visited);
        return visited[y];
    }

    private void DFS(int v, boolean[] visited) {
        visited[v] = true;
        for (Integer x : nodes[v]) {
            if (visited[x] == false) {
                DFS(x, visited);
            }
        }
    }

    public static void main(String[] args) {
        Graph G = new Graph(10);
        G.addEdge(1, 2);
        G.addEdge(2, 3);
        G.addEdge(2, 4);
        G.addEdge(2, 5);
        G.addEdge(0, 9);

        System.out.println(G.hasPathToBFS(1, 3));
        System.out.println(G.hasPathToBFS(1, 5));
        System.out.println(G.hasPathToBFS(1, 9));
        System.out.println(G.hasPathToBFS(0, 9));
        System.out.println();
        System.out.println(G.hasPathToDFS(1, 3));
        System.out.println(G.hasPathToDFS(1, 5));
        System.out.println(G.hasPathToDFS(1, 9));
        System.out.println(G.hasPathToDFS(0, 9));
    }

}
