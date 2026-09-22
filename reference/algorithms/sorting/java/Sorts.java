/*
  Sandbox for the various search algorithms from Section 2 of
  Algorithms, 4th Edition
 */

import java.util.Arrays;

public class Sorts {
    static Helpers sortHelper = new Helpers();
    static BasicSorts basicSort = new BasicSorts();
    static MergeSort mergeSort = new MergeSort();
    static QuickSort quickSort = new QuickSort();
    static QuickThreeSort quick3 = new QuickThreeSort();
    static HeapSort heapSort = new HeapSort();

    public static void main(String[] args) {
        //For reading in a premade file of ints
        //int[] masterArray = StdIn.readAllInts();
        
        //For passing in the length of the random array to be created
        //int length = Integer.parseInt(args[0]);  
        //int range = length;

        StdOut.println("Length of array to be generated");
        int length = StdIn.readInt();
        
        
        StdOut.println("Range of random values (0 to: X");
        int range =  StdIn.readInt();
        
        int[] masterArray =  new int[length];
        for (int i = 0; i < length; i++) {
            masterArray[i] = StdRandom.uniform(range);
        }
        
        StdOut.println();
        StdOut.println();

        //Will display the array if it's reasonably short
        if(length <= 20) {
            StdOut.println("Master Array");        
            for(int i=0; i < length; i++) {
               StdOut.print(masterArray[i] + " ");
            }
            StdOut.println();
            StdOut.println();
        }

        
        //Selection Sort
        StdOut.println("Selection Sort...");
                
        Integer[] selectionArray = new Integer[length];  
        arrayCopy(masterArray, selectionArray, false);
        Stopwatch t1 = new Stopwatch();

        basicSort.selectionSort(selectionArray);

        if (sortHelper.isSorted(selectionArray)){
            StdOut.println("Successful, running time: " + t1.elapsedTime());
        }
        StdOut.println();
        
        
        //Insertion Sort
        StdOut.println("Insertion Sort"); 
              
        Integer[] insertionArray = new Integer[length];  
        arrayCopy(masterArray, insertionArray, false);
        Stopwatch t2 = new Stopwatch();

        basicSort.insertionSort(insertionArray, 0, length - 1);

        if (sortHelper.isSorted(insertionArray)){
            StdOut.println("Successful, running time: " + t2.elapsedTime());
        }
        StdOut.println();
        
        
        //Shell Sort
        StdOut.println("Shell Sort...");
        
        Integer[] shellArray = new Integer[length];  
        arrayCopy(masterArray, shellArray, false);
        Stopwatch t3 = new Stopwatch();

        basicSort.shellSort(shellArray);

        if (sortHelper.isSorted(shellArray)){
            StdOut.println("Successful, running time: " + t3.elapsedTime());
        }
        StdOut.println();
        

        //Merge Sort
        StdOut.println("Merge Sort...");
        
        Integer[] mergeArray = new Integer[length];  
        arrayCopy(masterArray, mergeArray, false);
        Stopwatch t4 = new Stopwatch();

        mergeSort.sort(mergeArray);

        if (sortHelper.isSorted(mergeArray)){
            StdOut.println("Successful, running time: " + t4.elapsedTime());
        }
        StdOut.println();

        
        //Quick Sort
        StdOut.println("Quick Sort...");
                
        Integer[] quickArray = new Integer[length];  
        arrayCopy(masterArray, quickArray, false);
        Stopwatch t5 = new Stopwatch();

        quickSort.sort(quickArray);

        if (sortHelper.isSorted(quickArray)){
            StdOut.println("Successful, running time: " + t5.elapsedTime());
        }
        StdOut.println();


        //3-Way Quick Sort
        StdOut.println("3-Way Quick Sort...");

        Integer[] threeArray = new Integer[length];
        arrayCopy(masterArray, threeArray, false);
        Stopwatch t6 = new Stopwatch();

        quick3.sort(threeArray);

        if (sortHelper.isSorted(threeArray)){
            StdOut.println("Successful, running time: " + t6.elapsedTime());
        }
        StdOut.println();
        
        
        //Heap Sort
        StdOut.println("Heap Sort...");
                
        Integer[] binHeap = new Integer[length+1];  
        arrayCopy(masterArray, binHeap, true);
        Stopwatch t7 = new Stopwatch();

        heapSort.sort(binHeap);

        if (sortHelper.isSorted(binHeap, 1, length)){
            StdOut.println("Successful, running time: " + t7.elapsedTime());
        }
        StdOut.println();
    }
    
    public static void arrayCopy(int[] a, Integer[] b, boolean binHeap) {
        if(!binHeap) {
            for(int i = 0; i < a.length; i++) {
                b[i] = a[i];
            }
        } else {
            for(int i = 0; i < a.length; i++) {
                b[i+1] = a[i];
            }
        }
    }
}