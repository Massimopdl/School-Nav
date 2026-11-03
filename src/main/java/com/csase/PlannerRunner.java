package com.csase;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.Scanner;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/*
 * Finds the quickest walking route between two school locations and prints
 * every checkpoint along the way with the walking time between them
 */
public class PlannerRunner {

    // Same graph file the React app uses
    private static final String GRAPH_FILE = "src/data/schoolGraph.json";

    // Walking time used for edges that have not been timed yet (matches HALLWAY_SECONDS)
    private static final double UNMEASURED_SECONDS = 15;

    private static final Pattern NODE_PATTERN =
            Pattern.compile("\"id\":\\s*(\\d+),\\s*\"name\":\\s*\"([^\"]*)\"");
    private static final Pattern EDGE_PATTERN =
            Pattern.compile("\"from\":\\s*(\\d+),\\s*\"to\":\\s*(\\d+),\\s*\"timeSeconds\":\\s*(null|[\\d.]+)");

    private static Map<Integer, String> names = new TreeMap<>();     // node id -> name
    private static Map<Integer, List<Edge>> adjacency = new HashMap<>();

    /*
     * One walkable connection from a node to a neighbor
     */
    private record Edge(int to, double seconds, boolean measured) {}

    public static void main(String[] args) throws IOException {
        loadGraph(args.length > 0 ? args[0] : GRAPH_FILE);

        Scanner scanner = new Scanner(System.in);
        System.out.println("Welcome to School Nav!");

        while (true) {
            int start = askForLocation(scanner, "Where are you starting from?");
            if (start == -1) break;
            int destination = askForLocation(scanner, "Where do you want to go?");
            if (destination == -1) break;

            printRoute(start, destination);
            System.out.println();
        }

        System.out.println("Goodbye!");
    }

    /*
     * Reads the nodes and undirected edges out of the graph JSON file
     */
    private static void loadGraph(String file) throws IOException {
        String json = Files.readString(Path.of(file));

        Matcher node = NODE_PATTERN.matcher(json);
        while (node.find()) {
            names.put(Integer.parseInt(node.group(1)), node.group(2));
        }

        Matcher edge = EDGE_PATTERN.matcher(json);
        while (edge.find()) {
            int from = Integer.parseInt(edge.group(1));
            int to = Integer.parseInt(edge.group(2));
            boolean measured = !edge.group(3).equals("null");
            double seconds = measured ? Double.parseDouble(edge.group(3)) : UNMEASURED_SECONDS;
            if (from == to) continue;
            adjacency.computeIfAbsent(from, k -> new ArrayList<>()).add(new Edge(to, seconds, measured));
            adjacency.computeIfAbsent(to, k -> new ArrayList<>()).add(new Edge(from, seconds, measured));
        }
    }

    /*
     * Asks until the user types a node number or part of a location name.
     * Returns -1 if the user types "quit".
     */
    private static int askForLocation(Scanner scanner, String question) {
        while (true) {
            System.out.println(question + " (type a name or number, \"list\" to see all, \"quit\" to exit)");
            System.out.print("> ");
            if (!scanner.hasNextLine()) return -1;
            String input = scanner.nextLine().trim();

            if (input.equalsIgnoreCase("quit")) return -1;
            if (input.equalsIgnoreCase("list")) {
                names.forEach((id, name) -> System.out.println("  " + id + ". " + name));
                continue;
            }
            if (input.matches("\\d+")) {
                int id = Integer.parseInt(input);
                if (names.containsKey(id)) return id;
                System.out.println("No location numbered " + id + ".");
                continue;
            }

            List<Integer> matches = new ArrayList<>();
            for (Map.Entry<Integer, String> entry : names.entrySet()) {
                if (entry.getValue().equalsIgnoreCase(input)) return entry.getKey();
                if (entry.getValue().toLowerCase().contains(input.toLowerCase())) matches.add(entry.getKey());
            }

            if (matches.size() == 1) {
                System.out.println("Using " + names.get(matches.get(0)) + ".");
                return matches.get(0);
            } else if (matches.isEmpty()) {
                System.out.println("No location matches \"" + input + "\".");
            } else {
                System.out.println("Several locations match, pick one by number:");
                for (int id : matches) System.out.println("  " + id + ". " + names.get(id));
            }
        }
    }

    /*
     * Finds the quickest route with Dijkstra's algorithm and prints each checkpoint
     */
    private static void printRoute(int start, int destination) {
        Map<Integer, Double> best = new HashMap<>();
        Map<Integer, Integer> previous = new HashMap<>();
        Map<Integer, Edge> previousEdge = new HashMap<>();
        PriorityQueue<double[]> queue = new PriorityQueue<>((a, b) -> Double.compare(a[1], b[1]));

        best.put(start, 0.0);
        queue.add(new double[] {start, 0});

        while (!queue.isEmpty()) {
            double[] next = queue.poll();
            int current = (int) next[0];
            if (next[1] > best.get(current)) continue;   // stale queue entry
            if (current == destination) break;

            for (Edge edge : adjacency.getOrDefault(current, List.of())) {
                double seconds = best.get(current) + edge.seconds();
                if (seconds < best.getOrDefault(edge.to(), Double.MAX_VALUE)) {
                    best.put(edge.to(), seconds);
                    previous.put(edge.to(), current);
                    previousEdge.put(edge.to(), edge);
                    queue.add(new double[] {edge.to(), seconds});
                }
            }
        }

        if (!best.containsKey(destination)) {
            System.out.println("Sorry, there is no known route from " + names.get(start)
                    + " to " + names.get(destination) + ".");
            return;
        }
        if (start == destination) {
            System.out.println("You are already at " + names.get(start) + "!");
            return;
        }

        // Walk backwards from the destination to rebuild the path
        List<Integer> path = new ArrayList<>();
        for (Integer at = destination; at != null; at = previous.get(at)) path.add(at);
        Collections.reverse(path);

        boolean hasEstimate = false;
        System.out.println();
        System.out.println("Route from " + names.get(start) + " to " + names.get(destination) + ":");
        System.out.println("  Start at " + names.get(start));
        for (int i = 1; i < path.size(); i++) {
            Edge edge = previousEdge.get(path.get(i));
            String time = formatSeconds(edge.seconds()) + (edge.measured() ? "" : " (estimated)");
            hasEstimate |= !edge.measured();
            System.out.println("  " + i + ". Walk to " + names.get(path.get(i)) + " - " + time);
        }
        System.out.println("Checkpoints: " + (path.size() - 1)
                + "   Total walking time: about " + formatSeconds(best.get(destination)));
        if (hasEstimate) {
            System.out.println("(Some legs have not been timed yet, so their times are estimates.)");
        }
    }

    /*
     * Formats seconds as "45s" or "1m 05s"
     */
    private static String formatSeconds(double seconds) {
        long rounded = Math.round(seconds);
        if (rounded < 60) return rounded + "s";
        return String.format("%dm %02ds", rounded / 60, rounded % 60);
    }
}
