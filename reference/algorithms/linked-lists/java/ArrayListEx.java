 import java.util.ArrayList;
 
/*
 * Generic ArrayList<T> collection demonstration.
 * From "Java How To Program, 10/e, Early Objects" - Chapter 7.
 */


 class ArrayListEx {
     
     public static void display(ArrayList<String> stringList) {
         //Print all items using enhanced for loop
         for (String toPrint : stringList) {  
             System.out.printf("%s ", toPrint); 
         }
         System.out.println();
     } //End display
     

     public static void main(String[] args) {
        ArrayList<String> stringList = new ArrayList<String>();

        stringList.add("John"); //Add John to end of list
        stringList.add(0, "Bob"); //Add Bob to beginning of the list
        stringList.add("Sam"); //Add Sam to the end of the list
        stringList.add("George"); //Add George to end of the list
        
        display(stringList);
        
        stringList.add(1, "Jacob"); //Add Jacob as second item in the list
        stringList.remove(0); //Remove the first item in the list
        
        display(stringList);
        
        stringList.remove("Sam"); //Remove first instance of Sam
        
        display(stringList);
        
        System.out.printf("The list does %s contain John%n",
                stringList.contains("John") ? "" : "not");
        
        System.out.printf("The list does %s contain Sam%n",
                stringList.contains("Sam") ? "" : "not");
        
    } //End main
    
} //End ArrayListEx
