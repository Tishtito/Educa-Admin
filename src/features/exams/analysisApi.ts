import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { ExamStatistics, StreamList } from '@/lib/api/types'

export function useStreamList(examId: number, gradeId: number | null) {
  return useQuery({
    queryKey: ['exams', 'results', examId, 'stream-list', gradeId],
    queryFn: ({ signal }) => api.get<StreamList>(`/exams/${examId}/stream-list`, { query: { grade_id: gradeId }, signal }),
    enabled: gradeId !== null,
  })
}

export function useExamStatistics(examId: number) {
  return useQuery({
    queryKey: ['exams', 'results', examId, 'statistics'],
    queryFn: ({ signal }) => api.get<ExamStatistics>(`/exams/${examId}/statistics`, { signal }),
  })
}
